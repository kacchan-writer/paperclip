from __future__ import annotations

import logging
import urllib.parse
import urllib.request
import urllib.robotparser

logger = logging.getLogger(__name__)


class RobotsComplianceChecker:
    """Fetches and caches robots.txt policies per host."""

    def __init__(self, user_agent: str) -> None:
        self._user_agent = user_agent
        self._parsers: dict[str, urllib.robotparser.RobotFileParser] = {}

    def is_allowed(self, url: str) -> bool:
        parsed = urllib.parse.urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        parser = self._parsers.get(parsed.netloc)
        if parser is None:
            parser = urllib.robotparser.RobotFileParser()
            robots_url = urllib.parse.urlunparse(
                (parsed.scheme, parsed.netloc, "/robots.txt", "", "", "")
            )
            try:
                with urllib.request.urlopen(robots_url, timeout=10) as response:
                    content = response.read().decode("utf-8", errors="replace")
                parser.parse(content.splitlines())
            except Exception as exc:  # pragma: no cover - network variance
                logger.warning("Failed to load robots.txt from %s: %s", robots_url, exc)
                parser = urllib.robotparser.RobotFileParser()
                parser.parse([])
            self._parsers[parsed.netloc] = parser
        return parser.can_fetch(self._user_agent, url)
