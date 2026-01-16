# Paperclip

Paperclip provides lightweight scraping helpers with per-source rate limits, robots.txt checks,
terms policy enforcement, and retry/metrics logging.

## Example

```python
from paperclip import Fetcher, RateLimiter, MetricsRecorder, RetryPolicy, SourcePolicy, TermsPolicy
from paperclip.fetcher import FailureLogger

policy = SourcePolicy(
    name="news",
    user_agent="PaperclipBot/1.0",
    rate_limit_per_minute=30,
    retry_policy=RetryPolicy(max_attempts=3, base_backoff_seconds=1.0),
    terms_policy=TermsPolicy.from_iterables(prohibited_domains=["example.com"]),
)

fetcher = Fetcher(
    source_policies={"news": policy},
    rate_limiter=RateLimiter(),
    metrics=MetricsRecorder(),
    failure_logger=FailureLogger("failures.log"),
)

result = fetcher.fetch("https://www.example.org", source_name="news")
if result:
    print(result.status_code)
else:
    print(fetcher.metrics.snapshot())
```
