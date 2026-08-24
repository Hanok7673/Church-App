#!/usr/bin/env python3
"""Extract public metadata from one Google Play app listing.

The scraper checks robots.txt before accessing the listing, performs at most
five top-level requests per minute, and makes a single headless-browser
navigation only when the requests response is missing dynamically rendered
metadata. It intentionally does not access reviews, APKs, private APIs, or app
content.
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, Tag


TARGET_URL = (
    "https://play.google.com/store/apps/details"
    "?id=com.nmtech.christainbhajanandchords"
)
CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/151.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": CHROME_USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}
MAX_ATTEMPTS = 3
MAX_REQUESTS_PER_MINUTE = 5
MIN_REQUEST_INTERVAL_SECONDS = 60.0 / MAX_REQUESTS_PER_MINUTE
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class RobotsDeniedError(RuntimeError):
    """Raised when the site's robots.txt does not permit the target URL."""


@dataclass
class AppMetadata:
    source_url: str
    scraped_at_utc: str
    retrieval_method: str = "requests"
    app_name: str | None = None
    developer: str | None = None
    rating_score: float | None = None
    total_reviews_count: int | None = None
    number_of_installs: str | None = None
    app_size: str | None = None
    current_version: str | None = None
    android_os_requirement: str | None = None
    app_description: str | None = None
    screenshot_urls: list[str] = field(default_factory=list)
    last_updated_date: str | None = None


class RequestPacer:
    """Keep top-level navigations below the configured per-minute ceiling."""

    def __init__(self, minimum_interval: float = MIN_REQUEST_INTERVAL_SECONDS) -> None:
        self.minimum_interval = minimum_interval
        self._last_request_started: float | None = None

    def wait(self) -> None:
        jitter = random.uniform(1.0, 3.0)
        delay = jitter
        if self._last_request_started is not None:
            elapsed = time.monotonic() - self._last_request_started
            delay = max(0.0, self.minimum_interval - elapsed) + jitter
        time.sleep(delay)
        self._last_request_started = time.monotonic()


def localized_url(url: str) -> str:
    """Request stable English labels while preserving the app id."""

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("hl", "en")
    query.setdefault("gl", "US")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def fetch_with_retries(
    session: requests.Session,
    url: str,
    pacer: RequestPacer,
    *,
    timeout: tuple[float, float] = (10.0, 30.0),
) -> requests.Response:
    """Fetch a page with low-rate exponential backoff for temporary failures."""

    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        pacer.wait()
        try:
            response = session.get(url, timeout=timeout, allow_redirects=True)
            if response.status_code not in RETRYABLE_STATUS_CODES:
                response.raise_for_status()
                return response

            retry_after = response.headers.get("Retry-After", "").strip()
            retry_after_seconds = float(retry_after) if retry_after.isdigit() else 0.0
            backoff = max(retry_after_seconds, (2**attempt) + random.uniform(0.5, 1.5))
            logging.warning(
                "Temporary HTTP %s; retrying after %.1f seconds.",
                response.status_code,
                backoff,
            )
            time.sleep(backoff)
        except requests.RequestException as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS - 1:
                break
            backoff = (2**attempt) + random.uniform(0.5, 1.5)
            logging.warning("Request failed; retrying after %.1f seconds: %s", backoff, exc)
            time.sleep(backoff)

    if last_error is not None:
        raise RuntimeError(f"Request failed after {MAX_ATTEMPTS} attempts: {last_error}")
    raise RuntimeError(f"Server remained unavailable after {MAX_ATTEMPTS} attempts: {url}")


def verify_robots_permission(
    session: requests.Session,
    target_url: str,
    pacer: RequestPacer,
) -> None:
    """Fetch and enforce the robots.txt policy for the exact target URL."""

    robots_url = urljoin(target_url, "/robots.txt")
    response = fetch_with_retries(session, robots_url, pacer)
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(response.text.splitlines())
    if not parser.can_fetch(CHROME_USER_AGENT, target_url):
        raise RobotsDeniedError(f"robots.txt does not permit fetching {target_url}")


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text or None


def first_number(text: str) -> float | None:
    """Read the first decimal number without using markup-dependent regex."""

    numeric_text = "".join(character if character.isdigit() or character in ".," else " " for character in text)
    for token in numeric_text.split():
        normalized = token.replace(",", "")
        try:
            return float(normalized)
        except ValueError:
            continue
    return None


def human_count_to_int(text: str | int | float | None) -> int | None:
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return int(text)

    compact = clean_text(text)
    if compact is None:
        return None
    upper = compact.upper().replace(",", "")
    multiplier = 1
    if "B" in upper:
        multiplier = 1_000_000_000
    elif "M" in upper:
        multiplier = 1_000_000
    elif "K" in upper:
        multiplier = 1_000
    number = first_number(upper)
    return int(number * multiplier) if number is not None else None


def iter_json_ld_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from iter_json_ld_objects(item)
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from iter_json_ld_objects(item)


def find_app_json_ld(soup: BeautifulSoup) -> dict[str, Any]:
    app_types = {"SoftwareApplication", "MobileApplication", "Application"}
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        payload = script.string or script.get_text()
        if not payload.strip():
            continue
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            continue
        for candidate in iter_json_ld_objects(parsed):
            candidate_type = candidate.get("@type")
            types = {candidate_type} if isinstance(candidate_type, str) else set(candidate_type or [])
            if types.intersection(app_types):
                return candidate
    return {}


def extract_author(value: Any) -> str | None:
    if isinstance(value, dict):
        return clean_text(value.get("name"))
    if isinstance(value, list):
        names = [extract_author(item) for item in value]
        return ", ".join(name for name in names if name) or None
    return clean_text(value)


def extract_image_urls(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value] if value.startswith("https://") else []
    if isinstance(value, dict):
        return extract_image_urls(value.get("url") or value.get("contentUrl"))
    if isinstance(value, list):
        urls: list[str] = []
        for item in value:
            urls.extend(extract_image_urls(item))
        return urls
    return []


def first_selected_text(soup: BeautifulSoup, selectors: Iterable[str]) -> str | None:
    for selector in selectors:
        element = soup.select_one(selector)
        if element is not None:
            text = clean_text(element.get_text(" ", strip=True))
            if text:
                return text
    return None


def own_text(element: Tag) -> str | None:
    direct_strings = [str(item) for item in element.find_all(string=True, recursive=False)]
    return clean_text(" ".join(direct_strings))


def extract_labeled_value(soup: BeautifulSoup, labels: Iterable[str]) -> str | None:
    """Find definition-like values near stable visible English labels."""

    normalized_labels = {clean_text(label).casefold() for label in labels if clean_text(label)}
    for element in soup.find_all(["div", "span", "dt", "th"]):
        label_text = own_text(element)
        if label_text is None or label_text.casefold() not in normalized_labels:
            continue

        for parent in list(element.parents)[:5]:
            if not isinstance(parent, Tag):
                continue
            texts: list[str] = []
            for item in parent.stripped_strings:
                normalized = clean_text(item)
                if normalized and normalized not in texts:
                    texts.append(normalized)
            if len(texts) < 2 or len(texts) > 10:
                continue
            for text in texts:
                if text.casefold() not in normalized_labels:
                    return text
    return None


def extract_aria_metadata(soup: BeautifulSoup) -> tuple[float | None, int | None]:
    rating: float | None = None
    reviews: int | None = None
    for element in soup.find_all(attrs={"aria-label": True}):
        aria_label = clean_text(element.get("aria-label"))
        if aria_label is None:
            continue
        folded = aria_label.casefold()
        if rating is None and "star" in folded:
            rating = first_number(aria_label)
        if reviews is None and "review" in folded:
            reviews = human_count_to_int(aria_label)
    return rating, reviews


def extract_screenshots(soup: BeautifulSoup, json_ld: dict[str, Any]) -> list[str]:
    urls = extract_image_urls(json_ld.get("screenshot"))
    for image in soup.find_all("img"):
        alt = clean_text(image.get("alt")) or ""
        parent_label = ""
        for parent in list(image.parents)[:3]:
            if isinstance(parent, Tag) and parent.get("aria-label"):
                parent_label = clean_text(parent.get("aria-label")) or ""
                break
        context = f"{alt} {parent_label}".casefold()
        if "screenshot" not in context and "screen image" not in context:
            continue
        source = image.get("src") or image.get("data-src")
        if isinstance(source, str) and source.startswith("https://"):
            urls.append(source)
    return list(dict.fromkeys(urls))


def extract_android_requirement(soup: BeautifulSoup, json_ld: dict[str, Any]) -> str | None:
    operating_system = clean_text(json_ld.get("operatingSystem"))
    if operating_system and operating_system.casefold() not in {"android", "android os"}:
        return operating_system
    return extract_labeled_value(soup, ("Requires Android", "Android requirement"))


def parse_metadata(html: str, source_url: str, retrieval_method: str) -> AppMetadata:
    soup = BeautifulSoup(html, "html.parser")
    json_ld = find_app_json_ld(soup)
    aggregate = json_ld.get("aggregateRating")
    if not isinstance(aggregate, dict):
        aggregate = {}

    aria_rating, aria_reviews = extract_aria_metadata(soup)
    description = clean_text(json_ld.get("description")) or first_selected_text(
        soup,
        ("div[itemprop='description']", "[data-g-id='description']", "div.bARER"),
    )
    if description and "<" in description:
        description = clean_text(BeautifulSoup(description, "html.parser").get_text(" "))

    rating_value = aggregate.get("ratingValue")
    rating = first_number(str(rating_value)) if rating_value is not None else aria_rating
    reviews = human_count_to_int(
        aggregate.get("ratingCount") or aggregate.get("reviewCount")
    ) or aria_reviews

    return AppMetadata(
        source_url=source_url,
        scraped_at_utc=datetime.now(timezone.utc).isoformat(),
        retrieval_method=retrieval_method,
        app_name=clean_text(json_ld.get("name"))
        or first_selected_text(soup, ("h1[itemprop='name']", "h1 span", "h1")),
        developer=extract_author(json_ld.get("author"))
        or first_selected_text(
            soup,
            (
                "a[href*='/store/apps/developer']",
                "a[href*='/store/apps/dev']",
                "a[href*='developer?id=']",
            ),
        ),
        rating_score=rating,
        total_reviews_count=reviews,
        number_of_installs=extract_labeled_value(soup, ("Downloads", "Installs")),
        app_size=clean_text(json_ld.get("fileSize"))
        or extract_labeled_value(soup, ("Download size", "App size", "Size")),
        current_version=clean_text(json_ld.get("softwareVersion"))
        or extract_labeled_value(soup, ("Current version", "App version", "Version")),
        android_os_requirement=extract_android_requirement(soup, json_ld),
        app_description=description,
        screenshot_urls=extract_screenshots(soup, json_ld),
        last_updated_date=clean_text(json_ld.get("dateModified"))
        or extract_labeled_value(soup, ("Updated on", "Last updated")),
    )


def needs_dynamic_render(metadata: AppMetadata) -> bool:
    core_missing = not metadata.app_name or not metadata.app_description or not metadata.screenshot_urls
    detail_values = (
        metadata.app_size,
        metadata.current_version,
        metadata.android_os_requirement,
        metadata.last_updated_date,
    )
    return core_missing or sum(value is None for value in detail_values) >= 2


def render_with_selenium(url: str, pacer: RequestPacer) -> str:
    """Render the public listing once and open its About dialog when available."""

    try:
        from selenium import webdriver
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as expected
        from selenium.webdriver.support.ui import WebDriverWait
        from webdriver_manager.chrome import ChromeDriverManager
    except ImportError as exc:
        raise RuntimeError(
            "Dynamic content requires selenium and webdriver-manager. "
            "Install scripts/requirements-play-store-scraper.txt."
        ) from exc

    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--lang=en-US")
    options.add_argument(f"--user-agent={CHROME_USER_AGENT}")
    options.add_experimental_option(
        "prefs",
        {
            "profile.default_content_setting_values.notifications": 2,
            "profile.managed_default_content_settings.images": 2,
        },
    )

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    try:
        driver.execute_cdp_cmd(
            "Network.setExtraHTTPHeaders",
            {"headers": {"Accept-Language": HEADERS["Accept-Language"], "DNT": "1"}},
        )
        pacer.wait()
        driver.get(url)
        wait = WebDriverWait(driver, 20)
        wait.until(expected.presence_of_element_located((By.TAG_NAME, "h1")))

        for button in driver.find_elements(By.TAG_NAME, "button"):
            aria_label = clean_text(button.get_attribute("aria-label")) or ""
            if "about this app" in aria_label.casefold():
                driver.execute_script("arguments[0].click();", button)
                try:
                    wait.until(expected.presence_of_element_located((By.CSS_SELECTOR, "div[role='dialog']")))
                except TimeoutException:
                    logging.info("About dialog did not appear; parsing the rendered page.")
                break
        return driver.page_source
    finally:
        driver.quit()


def merge_metadata(primary: AppMetadata, rendered: AppMetadata) -> AppMetadata:
    merged = asdict(primary)
    rendered_values = asdict(rendered)
    for key, value in rendered_values.items():
        if key in {"source_url", "scraped_at_utc", "retrieval_method"}:
            continue
        if value not in (None, "", []):
            merged[key] = value
    merged["retrieval_method"] = "requests+selenium"
    merged["scraped_at_utc"] = rendered.scraped_at_utc
    return AppMetadata(**merged)


def scrape(url: str, *, allow_selenium: bool = True) -> AppMetadata:
    request_url = localized_url(url)
    pacer = RequestPacer()
    session = requests.Session()
    session.headers.update(HEADERS)

    verify_robots_permission(session, request_url, pacer)
    response = fetch_with_retries(session, request_url, pacer)
    metadata = parse_metadata(response.text, url, "requests")

    if allow_selenium and needs_dynamic_render(metadata):
        logging.info("Some metadata is dynamic; switching to one headless Selenium render.")
        try:
            rendered_html = render_with_selenium(request_url, pacer)
            rendered = parse_metadata(rendered_html, url, "selenium")
            metadata = merge_metadata(metadata, rendered)
        except Exception as exc:  # The optional browser may be absent or blocked locally.
            reason = str(exc).splitlines()[0] or exc.__class__.__name__
            logging.warning(
                "Selenium fallback was unavailable; returning the requests metadata: %s",
                reason,
            )
    return metadata


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=TARGET_URL, help="Public Google Play app-details URL")
    parser.add_argument("--output", type=Path, help="Optional JSON output path")
    parser.add_argument(
        "--requests-only",
        action="store_true",
        help="Skip the Selenium fallback even if dynamic fields are absent",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        metadata = scrape(args.url, allow_selenium=not args.requests_only)
    except (RobotsDeniedError, RuntimeError, requests.RequestException) as exc:
        logging.error("%s", exc)
        return 1

    payload = json.dumps(asdict(metadata), ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
        logging.info("Saved metadata to %s", args.output)
    print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
