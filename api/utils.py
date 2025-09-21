import tempfile, os
from typing import List, Tuple

def safe_tempfile(suffix: str = "", prefix: str = "tmp", dir: str = None):
    return tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix=prefix, dir=dir)

def parse_page_ranges(ranges: str, total_pages: int) -> List[Tuple[int,int]]:
    ranges = (ranges or "1-").replace(" ", "")
    spans: List[Tuple[int,int]] = []
    for chunk in ranges.split(','):
        if '-' in chunk:
            start_str, end_str = chunk.split('-', 1)
            start = int(start_str) if start_str else 1
            end = int(end_str) if end_str else total_pages
        else:
            start = end = int(chunk)
        if start < 1 or end < 1 or start > total_pages:
            raise ValueError(f"Invalid start in range '{chunk}' for total {total_pages}")
        if end > total_pages:
            end = total_pages
        if start > end:
            raise ValueError(f"Start > end in range '{chunk}'")
        spans.append((start, end))
    return spans
