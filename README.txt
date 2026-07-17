GALAXY SPRITE CHECKLIST

Review build goals
- Four organized rarity pages: Rare, Epic, Legendary, and Mythic.
- Collected and Mastered progress saved on the current device.
- Momentum-based horizontal variant rows and full-page rarity swipes on phones.
- Keyboard-accessible rarity tabs and 44px minimum touch targets.
- Installable, offline-friendly GitHub Pages app.
- Visual Edit Mode for changing or removing text, replacing images, and hiding content.
- Export and import backups for moving custom designs and progress between devices.

Updating an existing live checklist
- Replace index.html, styles.css, app.js, and service-worker.js, then add the complete fonts folder. README.txt is optional.
- Keep the repository's existing published-design.js and published-assets folder so this code update does not overwrite the design that is already live.
- After GitHub Pages finishes deploying, unlock Owner access, enter Edit Mode, open Automatic sync, and connect the repository once. Future saved design changes will then publish automatically.

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
19. Automatic browser sync is the preferred publishing path. In Owner mode, open Automatic sync, create and paste a fine-grained GitHub token restricted to the Sprite-Checklist repository with Contents permission set to Read and write, then choose Connect and publish now. The token stays only in that owner browser and is never included in a public design or backup. Every later saved design edit publishes automatically. Prepare public design remains available as the manual fallback.
20. Edit page now controls a separate color and background image for each rarity page. Edit group controls a separate color and background image for that entire swipeable group box. Edit sprite controls a separate color and background image for that individual card. Each layer can use Cover, Contain, Repeat, or Stretch independently.
21. On phones, vertical gestures that begin over a sprite are reserved for moving the page. Clearly horizontal gestures move only the sprite row, so you no longer need to find an empty area before scrolling down.
22. Uploaded artwork is automatically resized and compressed for its destination: wide page and group backgrounds, shorter header art, portrait card backgrounds, square sprite/image-well art, and tall side artwork.
23. Published designs include a version timestamp. When a newer public design is deployed, browsers automatically adopt it while keeping their own Collected and Mastered progress. Local edits made after that publication remain local until the next public-design export.
24. This one-time optimized update deliberately includes published-design.js and the published-assets folder. Upload both so the current public design can render immediately without parsing a multi-megabyte embedded-image file. Normal future code-only update ZIPs can omit both items to avoid replacing the customized public design.
25. Editing is hidden behind a private owner key. Owner access remembers an approved browser until Lock owner mode is selected or that browser's site data is cleared. The key is stored only as a one-way hash in the public code; GitHub repository permissions remain the security boundary for changing the live public design.
26. There is no loading screen. The public design configuration is intentionally small and its background begins downloading immediately.
27. Sprite rows now use the browser's native touch scrolling and momentum instead of a custom pointer-direction lock. Safari decides the gesture once: vertical swipes over images move the page, while horizontal swipes move the sprite row and coast naturally. This removes the competing pointer capture and forced glide that could make diagonal or slow swipes hesitate.
28. Use the search bar to find a visible sprite by group, variant, or rarity. Results show the current collection status. Choosing a result opens the correct rarity page, centers and highlights the exact card, and focuses its inventory control; both inventory and crown controls remain available on that card.
29. Edit header includes a Crown instruction field for replacing or removing “Tap crown to master.”
30. Edit header also provides a direct header-image upload plus Cover, Contain, Repeat, and Stretch modes, box/text/border colors, corner roundness, opacity, and minimum banner height. Header artwork is automatically resized for a wide 1600 × 700 area before it is saved; the first uploaded image suggests a 220px banner height, while 0 returns to automatic sizing.
31. Public browsers check for a newer published design while open and whenever the page becomes active or reconnects. After GitHub Pages finishes deploying, the newer design is adopted without affecting each browser's personal Collected and Mastered marks.
32. Safari compatibility includes a preloaded bundled Playful webfont, opaque fallbacks for newer color functions, WebKit blur support, dynamic viewport sizing, a non-fixed iPhone/iPad background, and stacked editor controls at common iPhone widths. These prevent transparent boxes, mismatched typography, unstable fixed backgrounds, and cramped mobile dialogs that WebKit can otherwise display.
33. Automatic GitHub publishing requires the separate repository-limited token because the visual Owner key only unlocks local editing controls; it does not and should not contain permission to write to GitHub.
34. Image editors now show an in-dialog processing message, temporarily disable Save while artwork is being optimized, and show a visible storage error instead of appearing unresponsive. A successful Save closes the editor automatically and displays a longer confirmation notification. Uploaded artwork also uses adaptive WebP compression to reduce intermittent Safari storage failures.
35. In Edit Mode, the In Collection and Mastered progress boxes each have their own Move handle. Drag only that handle on a computer or phone to position the box anywhere inside the header; normal swipes elsewhere still scroll. Positions are stored as responsive percentages, saved automatically, included in backups and public publishing, and constrained inside the header on smaller screens. Edit header > Progress box positions can reset both boxes to their centered layout.
36. Background artwork now uses a high-detail profile instead of the former aggressive 58%-quality compression. Suitable PNG, JPG, WebP, and AVIF files are preserved without re-encoding when they already fit the destination and storage budget. Larger artwork uses high-quality canvas smoothing, a 78-80% quality floor, and dimensions up to 2560px for full/page backgrounds, 2000 × 1000 for headers, and 2000 × 1400 for collection/group boxes. This keeps Canva gradients, metallic textures, lettering, and detailed scenery substantially sharper while retaining Safari's visible storage-error protection.
37. Mobile sprite rows calculate card width from the row's real inner width instead of using a viewport estimate. Two complete sprite cards now fit cleanly at normal iPhone widths, one complete card fits on very narrow screens, and the final card reaches a crisp end without being sliced by the collection edge. Native momentum remains enabled with no scroll snapping, preserving vertical page swipes over sprite artwork.

Notes
- Mastering a sprite also marks it collected.
- Removing collected status also removes mastered status.
- Progress is stored separately in each browser/device.
