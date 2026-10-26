# Player photos and court

- `dist/assets/players/`: official NBA PNG headshots, named by NBA player ID.
- `dist/assets/players/sources.json`: names, source URLs, and original dimensions.
- `dist/assets/courts/miami-heat.png`: the exact court image selected by the user.
- `dist/assets/courts/sources.json`: original image URL and provenance.
- `dist/photos.css`: portrait sizes and court-card layout overrides.

The complete original court PNG is retained unchanged. An SVG image in
`dist/index.html` rotates and clips its left half into the half-court workspace.
There is no full-court toggle. The existing drag-and-drop and player selection
behavior are unchanged. `dist/app.js` attaches local player images by ID and
retains initials when a portrait cannot load.

Refresh official headshots from the app folder with:

```sh
python3 tools/download-headshots.py
```

NBA headshots: https://cdn.nba.com/headshots/nba/latest/260x190/{player_id}.png

User-selected court image:
https://basketballjerseyarchive.com/static/courts/PLcTcuMxP1phNua.png

Court source page:
https://basketballjerseyarchive.com/miami-heat-courts-t6054/
