# How to export expenses to CSV

Download your expenses as a spreadsheet file you can open in Excel, Google Sheets or Numbers, for budgeting, tax records or a backup.

**Where:** the **Expenses** page (top navigation bar)  ·  **Time:** about 1 minute

<!-- SCREENSHOT: 01-expenses-page.png — Expenses page at desktop width (1280×800), sample data loaded, no filters applied. Show the page header with "Clear all" and "Export CSV" buttons, the filter bar and the top of the list. -->
![Screenshot placeholder: the Expenses page with the Export CSV button in the top right](images/how-to-export-expenses-to-csv/01-expenses-page.png)

## Before you start
- You need at least one expense. No expenses yet? Click **Load sample data** on the dashboard or the Expenses page to try it out.
- Spendwise keeps your expenses only in this browser. Exporting is also a good way to keep a copy.

## Steps
1. Click **Expenses** in the top navigation bar.
2. *(Optional)* Narrow down what you export. Only the expenses shown in the list end up in the file:
   - type in **Search descriptions…** to match words in the description or the category name
   - pick a category from **All categories**
   - set the from and to dates, or click **This month**, **Last 30 days** or **This year**
   - choose the order from the sort menu (**Newest first**, **Oldest first**, **Highest amount**, **Lowest amount**). The file keeps the same order.

   <!-- SCREENSHOT: 02-filter-bar.png — Crop to the filter bar card only, with "This month" selected (highlighted) and the "Clear filters" link visible. Sample data loaded, desktop width. -->
   ![Screenshot placeholder: the filter bar with This month selected](images/how-to-export-expenses-to-csv/02-filter-bar.png)
3. Check the line above the list, for example "Showing **12** of 45 · Total $1,234.56". That is exactly what will be exported.
4. Click **Export CSV** in the top right of the page.

   <!-- SCREENSHOT: 03-export-button.png — Expenses page header, desktop width, sample data loaded, mouse hovering "Export CSV" (consider a highlight box around the button). -->
   ![Screenshot placeholder: the Export CSV button](images/how-to-export-expenses-to-csv/03-export-button.png)

## What happens next
- A green message appears at the bottom of the screen: **"Exported 12 expenses to CSV"** (with your number).
- Your browser downloads a file named like **expenses-2026-11-22.csv**, usually into your Downloads folder.
- The file has four columns: **Date**, **Category**, **Description** and **Amount**. Amounts are plain numbers with two decimals, without a currency symbol.

<!-- SCREENSHOT: 04-export-toast.png — Expenses page right after clicking Export CSV, desktop width, sample data loaded, green toast "Exported 45 expenses to CSV" visible bottom-right. -->
![Screenshot placeholder: the green confirmation message after exporting](images/how-to-export-expenses-to-csv/04-export-toast.png)

## Tips
- **To export everything,** click **Clear filters** (it appears when a filter is on) before exporting.
- **Opens correctly in Excel:** the file is saved so that accented letters and symbols display properly.
- **Descriptions that start with `=`, `+`, `-` or `@`** get a leading apostrophe (`'`) in the file. This stops spreadsheet apps from treating them as formulas. Delete it in your spreadsheet if you don't need it.
- **On a phone,** the list shows as cards instead of a table, but **Export CSV** works the same. If the header is narrow, the buttons move below the page title.
- **Before using "Clear all",** export a CSV first. Deleting all expenses can't be undone.

## Troubleshooting
| Problem | What to do |
|---|---|
| **Export CSV** is greyed out | Either nothing is shown in the list or the page is still loading. If you see "No matching expenses", click **Clear filters** or loosen your search. If you see "No expenses yet", add an expense or click **Load sample data**. |
| Red message "Export failed. Please try again." | Your browser stopped the download. Try again, and check that downloads aren't blocked for this site. |
| Green message appeared but no file | Some browsers ask where to save, or block downloads quietly. Check your browser's downloads list and its site settings. |
| The file has fewer rows than expected | Only the expenses currently shown get exported. Clear the search, category and date filters and export again. |
| The date in the file name is a day off | The file name uses the date in UTC, which can differ from your local date late at night or early in the morning. The expense dates inside the file are not affected. |

## Related
- [Spendwise README](../../README.md): overview of all features
- *For developers:* [CSV Export implementation](../dev/csv-export-implementation.md)
