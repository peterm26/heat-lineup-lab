"""Download public NBA portraits for the roster; player IDs stay unchanged."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import struct
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
players = json.loads((ROOT / 'dist/players.json').read_text())['players']
destination = ROOT / 'dist/assets/players'
destination.mkdir(parents=True, exist_ok=True)


def download(player):
    url = f"https://cdn.nba.com/headshots/nba/latest/260x190/{player['id']}.png"
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=25) as response:
        content = response.read()
    if not content.startswith(b'\x89PNG\r\n\x1a\n') or len(content) < 1000:
        raise ValueError(f"Invalid portrait for {player['name']}")
    width, height = struct.unpack('>II', content[16:24])
    target = destination / f"{player['id']}.png"
    target.write_bytes(content)
    return {'nba_player_id': player['id'], 'name': player['name'],
            'path': f"assets/players/{player['id']}.png", 'source_url': url,
            'width': width, 'height': height}


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(download, players))
    (destination / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
    print(f'Downloaded and validated {len(records)} official NBA portraits.')
