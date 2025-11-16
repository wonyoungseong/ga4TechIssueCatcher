#!/usr/bin/env python3
"""
Convert Numbers file to CSV for property data import
"""
import csv
import sys
from numbers_parser import Document

def convert_numbers_to_csv(numbers_file, csv_file):
    """Convert Numbers file to CSV"""
    try:
        # Open Numbers document
        doc = Document(numbers_file)

        # Get first sheet
        sheets = doc.sheets
        if not sheets:
            print("Error: No sheets found in Numbers file")
            return False

        sheet = sheets[0]
        tables = sheet.tables

        if not tables:
            print("Error: No tables found in sheet")
            return False

        table = tables[0]

        # Write to CSV
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            # Write all rows
            for row in table.iter_rows():
                row_data = []
                for cell in row:
                    value = cell.value
                    # Convert None to empty string
                    if value is None:
                        value = ''
                    row_data.append(str(value))
                writer.writerow(row_data)

        print(f"✅ Successfully converted to {csv_file}")
        return True

    except Exception as e:
        print(f"❌ Error converting file: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    numbers_file = '/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/data/계정속성관리_컨플루언스_v1.0.numbers'
    csv_file = '/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/data/properties-import.csv'

    if convert_numbers_to_csv(numbers_file, csv_file):
        sys.exit(0)
    else:
        sys.exit(1)
