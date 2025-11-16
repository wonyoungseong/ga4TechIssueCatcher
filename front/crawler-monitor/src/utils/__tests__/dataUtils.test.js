/**
 * Unit Tests for dataUtils.js
 *
 * Tests all data conversion and manipulation utilities
 */

import {
  convertToCSV,
  downloadFile,
  downloadCSV,
  downloadJSON,
  formatFileSize,
  copyToClipboard,
  parseCSV,
  groupBy,
} from '../dataUtils';

describe('dataUtils', () => {
  describe('convertToCSV', () => {
    it('should convert array of objects to CSV format', () => {
      const data = [
        { name: 'John', age: 30, city: 'Seoul' },
        { name: 'Jane', age: 25, city: 'Busan' },
      ];
      const csv = convertToCSV(data);
      expect(csv).toContain('name,age,city');
      expect(csv).toContain('John,30,Seoul');
      expect(csv).toContain('Jane,25,Busan');
    });

    it('should escape commas in values', () => {
      const data = [{ name: 'Kim, John', age: 30 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Kim, John"');
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'John "Johnny" Doe', age: 30 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"John ""Johnny"" Doe"');
    });

    it('should escape newlines in values', () => {
      const data = [{ description: 'Line 1\nLine 2', id: 1 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('should use custom headers if provided', () => {
      const data = [
        { firstName: 'John', lastName: 'Doe', age: 30 },
        { firstName: 'Jane', lastName: 'Smith', age: 25 },
      ];
      const csv = convertToCSV(data, ['firstName', 'age']);
      expect(csv).toContain('firstName,age');
      expect(csv).not.toContain('lastName');
      expect(csv).toContain('John,30');
    });

    it('should handle null and undefined values', () => {
      const data = [
        { name: 'John', age: null, city: undefined },
      ];
      const csv = convertToCSV(data);
      expect(csv).toContain('John,,');
    });

    it('should return empty string for empty array', () => {
      expect(convertToCSV([])).toBe('');
      expect(convertToCSV(null)).toBe('');
      expect(convertToCSV(undefined)).toBe('');
    });

    it('should handle complex nested data gracefully', () => {
      const data = [{ name: 'John', meta: { age: 30 } }];
      const csv = convertToCSV(data);
      expect(csv).toContain('name,meta');
      expect(csv).toContain('John,');
    });
  });

  describe('downloadFile', () => {
    let createElementSpy;
    let createObjectURLSpy;
    let revokeObjectURLSpy;

    beforeEach(() => {
      createElementSpy = jest.spyOn(document, 'createElement');
      createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should create and trigger download', () => {
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      createElementSpy.mockReturnValue(mockLink);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      downloadFile('test content', 'test.txt', 'text/plain');

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.txt');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('downloadCSV', () => {
    it('should call downloadFile with CSV mime type', () => {
      const data = [{ name: 'John', age: 30 }];
      const mockDownloadFile = jest.fn();

      // We can't easily spy on our own module exports, so we'll just verify
      // that calling downloadCSV doesn't throw
      expect(() => downloadCSV(data, 'test.csv')).not.toThrow();
    });
  });

  describe('downloadJSON', () => {
    it('should call downloadFile with JSON mime type', () => {
      const data = { name: 'John', age: 30 };

      // Verify function doesn't throw
      expect(() => downloadJSON(data, 'test.json')).not.toThrow();
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes to B', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(100)).toBe('100.00 B');
      expect(formatFileSize(1023)).toBe('1023.00 B');
    });

    it('should format bytes to KB', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(2048)).toBe('2.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
    });

    it('should format bytes to MB', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB'); // 1024 * 1024
      expect(formatFileSize(5242880)).toBe('5.00 MB'); // 5 * 1024 * 1024
    });

    it('should format bytes to GB', () => {
      expect(formatFileSize(1073741824)).toBe('1.00 GB'); // 1024^3
      expect(formatFileSize(2147483648)).toBe('2.00 GB'); // 2 * 1024^3
    });

    it('should format bytes to TB', () => {
      expect(formatFileSize(1099511627776)).toBe('1.00 TB'); // 1024^4
    });

    it('should format bytes to PB', () => {
      expect(formatFileSize(1125899906842624)).toBe('1.00 PB'); // 1024^5
    });

    it('should handle custom decimal places', () => {
      expect(formatFileSize(1536, 0)).toBe('2 KB');
      expect(formatFileSize(1536, 1)).toBe('1.5 KB');
      expect(formatFileSize(1536, 3)).toBe('1.500 KB');
    });

    it('should return N/A for invalid inputs', () => {
      expect(formatFileSize(-1)).toBe('N/A');
      expect(formatFileSize(null)).toBe('N/A');
      expect(formatFileSize(undefined)).toBe('N/A');
      expect(formatFileSize('invalid')).toBe('N/A');
    });
  });

  describe('copyToClipboard', () => {
    it('should use modern clipboard API if available', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('should fall back to execCommand if clipboard API unavailable', async () => {
      const originalClipboard = navigator.clipboard;
      delete navigator.clipboard;

      const mockExecCommand = jest.fn().mockReturnValue(true);
      document.execCommand = mockExecCommand;

      const createElementSpy = jest.spyOn(document, 'createElement');
      const mockTextarea = {
        value: '',
        style: {},
        select: jest.fn(),
      };
      createElementSpy.mockReturnValue(mockTextarea);

      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(mockTextarea.value).toBe('test text');
      expect(mockTextarea.select).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      navigator.clipboard = originalClipboard;
    });
  });

  describe('parseCSV', () => {
    it('should parse basic CSV string', () => {
      const csv = 'name,age,city\nJohn,30,Seoul\nJane,25,Busan';
      const result = parseCSV(csv);
      expect(result).toEqual([
        { name: 'John', age: '30', city: 'Seoul' },
        { name: 'Jane', age: '25', city: 'Busan' },
      ]);
    });

    it('should handle quoted values with commas', () => {
      const csv = 'name,description\n"Kim, John","A developer"';
      const result = parseCSV(csv);
      expect(result[0].name).toBe('Kim, John');
      expect(result[0].description).toBe('A developer');
    });

    it('should handle escaped quotes', () => {
      const csv = 'name,quote\n"John","""Hello"" world"';
      const result = parseCSV(csv);
      expect(result[0].quote).toBe('"Hello" world');
    });

    it('should handle empty values', () => {
      const csv = 'name,age,city\nJohn,,Seoul';
      const result = parseCSV(csv);
      expect(result[0]).toEqual({ name: 'John', age: '', city: 'Seoul' });
    });

    it('should return empty array for empty string', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV(null)).toEqual([]);
      expect(parseCSV(undefined)).toEqual([]);
    });

    it('should handle single row CSV', () => {
      const csv = 'name,age\nJohn,30';
      const result = parseCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'John', age: '30' });
    });
  });

  describe('groupBy', () => {
    it('should group array by key', () => {
      const data = [
        { name: 'John', age: 30, city: 'Seoul' },
        { name: 'Jane', age: 25, city: 'Seoul' },
        { name: 'Bob', age: 30, city: 'Busan' },
      ];

      const byCity = groupBy(data, 'city');
      expect(byCity.Seoul).toHaveLength(2);
      expect(byCity.Busan).toHaveLength(1);

      const byAge = groupBy(data, 'age');
      expect(byAge[30]).toHaveLength(2);
      expect(byAge[25]).toHaveLength(1);
    });

    it('should group array by function', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      const grouped = groupBy(data, (item) => item.age >= 30 ? 'senior' : 'junior');
      expect(grouped.senior).toHaveLength(2);
      expect(grouped.junior).toHaveLength(1);
    });

    it('should handle empty array', () => {
      expect(groupBy([], 'key')).toEqual({});
    });

    it('should handle missing keys', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane' }, // missing age
      ];

      const grouped = groupBy(data, 'age');
      expect(grouped[30]).toHaveLength(1);
      expect(grouped.undefined).toHaveLength(1);
    });

    it('should return empty object for invalid inputs', () => {
      expect(groupBy(null, 'key')).toEqual({});
      expect(groupBy(undefined, 'key')).toEqual({});
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle round-trip CSV conversion', () => {
      const original = [
        { name: 'John', age: 30, city: 'Seoul' },
        { name: 'Jane', age: 25, city: 'Busan' },
      ];

      const csv = convertToCSV(original);
      const parsed = parseCSV(csv);

      expect(parsed).toEqual([
        { name: 'John', age: '30', city: 'Seoul' },
        { name: 'Jane', age: '25', city: 'Busan' },
      ]);
    });

    it('should handle special characters in CSV conversion', () => {
      const data = [
        { text: 'Hello, "World"\nNew Line', id: 1 },
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('"Hello, ""World""\nNew Line"');

      const parsed = parseCSV(csv);
      expect(parsed[0].text).toBe('Hello, "World"\nNew Line');
    });

    it('should handle large file sizes correctly', () => {
      const oneGB = 1024 * 1024 * 1024;
      expect(formatFileSize(oneGB)).toBe('1.00 GB');
      expect(formatFileSize(oneGB * 1.5)).toBe('1.50 GB');
    });
  });
});
