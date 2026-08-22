---
name: parse-azs-images
description: >-
  Use this skill when the user asks to parse, recognize, or load images with AZS schedules (графики АЗС) and fill or update the Supabase database.
---

# Parse AZS Schedules from Images

This skill explains how to extract working hours from images containing AZS schedules and save them to the project's Supabase database.

## Steps

1. **Find the Images**: The images are usually located in the `data/` directory. Use the `list_dir` tool to list the contents of `d:\code\azs-hours\data`.
2. **Read the Images**: Use the `view_file` tool to view each image file. This tool supports image files and will load the image into your context, allowing you to extract text and tables from it.
3. **Understand the Schedule Structure**:
   - Each image usually has a date at the top (e.g., `22.08.2026`).
   - The table columns include `№ АЗС` (Station Number), `Адрес` (Address), `Время работы` (Working Hours), and `АЗС` (Brand, like ЛУКОЙЛ or ГАЗПРОМ).
4. **Prepare the Data Script**: 
   - We use the `scripts/seed-images.js` script to upsert the extracted data.
   - You need to update the `records` array inside `scripts/seed-images.js` with the newly recognized data from the images. 
   - The format for the objects in the array is: `{ date: 'YYYY-MM-DD', st: 'Station Number', brand: 'Brand', addr: 'Address', time: 'HH:MM-HH:MM' }`.
5. **Run the Script**: 
   - Execute `node scripts/seed-images.js` to send the new records to the database.
   - If the terminal output shows fetch errors (e.g., rate limits), you can safely re-run the script since it uses idempotent upserts.
6. **Clean Up**: 
   - Once the database is successfully updated, delete the processed images from the `data/` directory so they are not parsed again in the future.
   - Delete the `scripts/seed-images.js` script to keep the workspace clean.
