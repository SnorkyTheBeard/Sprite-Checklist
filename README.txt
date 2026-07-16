GALAXY SPRITE CHECKLIST

Review build goals
- Four organized rarity pages: Rare, Epic, Legendary, and Mythic.
- Collected and Mastered progress saved on the current device.
- Horizontal variant rows and full-page rarity swipes on phones.
- Keyboard-accessible rarity tabs and 44px minimum touch targets.
- Installable, offline-friendly GitHub Pages app.
- Visual Edit Mode for changing or removing text, replacing images, and hiding content.
- Export and import backups for moving custom designs and progress between devices.

Quick review
1. Open index.html through a local web server or visit the GitHub Pages URL.
2. Test a sprite image, its Collected button, and its crown.
3. Switch every rarity tab and swipe a variant row on a phone.
4. Reload and confirm progress remains saved.
5. Open Reset all progress and verify the confirmation dialog.

Visual editing
1. Select Edit Mode below the header.
2. Open Design Studio to customize the complete visual theme.
3. Upload separate artwork for the main background, header box, current rarity page, collection boxes, sprite cards, image wells, and the left/right borders.
4. Choose separate body, heading, and button fonts, or upload your own WOFF, WOFF2, TTF, or OTF font.
5. Adjust title, page-heading, group-heading, sprite-label, and checklist-button sizes independently.
6. Change box colors, text colors, borders, opacity, corner roundness, image fit, tabs, counters, buttons, and check colors.
7. Design Studio changes preview immediately; select Apply design to save or Cancel to undo the preview.
8. Use Edit header, Edit page, Edit group, or Edit sprite directly on the item you want to change.
9. Leave a text field empty to remove that text.
10. Sprite images can be replaced from the phone or computer, removed, or restored.
   On a computer, you can also drag a PNG, JPG, WebP, GIF, or AVIF directly onto any sprite image box while Edit Mode is on. The highlighted box resizes and saves it automatically.
   The regular image picker remains available for phones and tablets.
11. Every row includes editable Cube, Gem, and Quack boxes. They start empty so you can add your own art.
12. Reorder boxes independently in Edit Mode. On a computer, drag the Move handle and drop on the left or right side of another box. On a phone or tablet, use the left and right arrow buttons. Each row remembers its own order.
13. Select Add sprite group to create a future group, choose its rarity, and enter any comma-separated starting boxes you need.
14. Edit group can rename or reclassify a group, hide it temporarily, or delete the entire group after confirmation.
15. Select Add box on any row to append one empty sprite box. Open an individual sprite and choose Delete this box to remove only that box.
16. Hidden sprites and groups remain visible in Edit Mode so they can be restored later.
17. Use Export backup before moving devices or making large changes. Import backup restores the complete design, custom groups and boxes, custom art, fonts, row order, and checklist progress.
18. Select Save changes whenever you want reassurance that the current design and progress are stored. Individual edits also continue to save automatically.
19. To publish your finished visual design for everyone, select Prepare public design. The publishing screen reports the generated file size and embedded image count. Choose Download published-design.js, or use Share/Save to Files on supported phones. Upload that generated file to the root of your GitHub repository, replace the older file, and commit the change. Do not upload the blank published-design.js from the app ZIP. GitHub Pages will use the generated file as the default design for every visitor. Collected and Mastered marks remain personal to each device.
20. Edit page now controls a separate color and background image for each rarity page. Edit group controls a separate color and background image for that entire swipeable group box. Edit sprite controls a separate color and background image for that individual card. Each layer can use Cover, Contain, Repeat, or Stretch independently.
21. On phones, vertical gestures that begin over a sprite are reserved for moving the page. Clearly horizontal gestures move only the sprite row, so you no longer need to find an empty area before scrolling down.
22. Uploaded artwork is automatically resized and compressed for its destination: wide page and group backgrounds, shorter header art, portrait card backgrounds, square sprite/image-well art, and tall side artwork.

Notes
- Mastering a sprite also marks it collected.
- Removing collected status also removes mastered status.
- Progress is stored separately in each browser/device.
