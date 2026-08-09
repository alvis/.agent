"""Regression coverage for stateful interaction audits."""

from pathlib import Path

from pytest import MonkeyPatch

from audit_cli.crawl.page import (
    ViewportSpec,
    _probe_home_logo_behavior,
    _probe_modal_backdrop,
    audit_page,
)
from audit_cli.crawl.queue import CrawlQueue
from audit_cli.drive.browser import BrowserDriver, BrowserDriverError, BrowserResult
from audit_cli.drive.inject import AuditServer
from audit_cli.types import InteractionCandidate, InteractionPlan

SERVER = AuditServer(host="127.0.0.1", port=0, scripts_dir=Path())
SUCCESS = BrowserResult(stdout="", stderr="", exit_code=0)


class _FakeDriver(BrowserDriver):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[object, ...]] = []

    def resize(self, width: int, height: int) -> BrowserResult:
        self.calls.append(("resize", width, height))
        return SUCCESS

    def navigate(self, url: str) -> BrowserResult:
        self.calls.append(("navigate", url))
        return SUCCESS

    def wait_for_fn(
        self, expression: str, *, timeout_ms: int = 3000
    ) -> BrowserResult:
        self.calls.append(("wait_for_fn", expression, timeout_ms))
        return SUCCESS

    def snapshot(self) -> dict[str, object]:
        self.calls.append(("snapshot",))
        return {"refs": {"e4": {"name": "Open navigation menu", "role": "button"}}}

    def get_url(self) -> str:
        self.calls.append(("get_url",))
        return "http://127.0.0.1:3200/"

    def click(self, uid: int) -> BrowserResult:
        self.calls.append(("click", uid))
        return SUCCESS

    def hover(self, target: int | str) -> BrowserResult:
        self.calls.append(("hover", target))
        return SUCCESS

    def evaluate(self, expression: str) -> BrowserResult:
        self.calls.append(("evaluate", expression))
        return BrowserResult(
            stdout='[{"result":{"result":"false"},"success":true,"error":null}]',
            stderr="",
            exit_code=0,
        )


class _ModalDriver(_FakeDriver):
    def evaluate(self, expression: str) -> BrowserResult:
        self.calls.append(("evaluate", expression))
        return BrowserResult(
            stdout='[{"result":{"result":"false"},"success":true,"error":null}]',
            stderr="",
            exit_code=0,
        )


class _TruthyEvalDriver(_FakeDriver):
    def evaluate(self, expression: str) -> BrowserResult:
        self.calls.append(("evaluate", expression))
        return BrowserResult(
            stdout='[{"result":{"result":"true"},"success":true,"error":null}]',
            stderr="",
            exit_code=0,
        )


class _LogoProbeDriver(_FakeDriver):
    def __init__(self, *, fail_wait: bool) -> None:
        super().__init__()
        self.fail_wait = fail_wait

    def evaluate(self, expression: str) -> BrowserResult:
        self.calls.append(("evaluate", expression))
        if "window.scrollTo" in expression:
            value = "240"
        elif "document.querySelector" in expression:
            value = "true"
        else:
            raise AssertionError(f"unexpected evaluation: {expression}")
        return BrowserResult(
            stdout=f'[{{"result":{{"result":"{value}"}},"success":true,"error":null}}]',
            stderr="",
            exit_code=0,
        )

    def wait_for_fn(
        self, expression: str, *, timeout_ms: int = 3000
    ) -> BrowserResult:
        self.calls.append(("wait_for_fn", expression, timeout_ms))
        if self.fail_wait and "scrollY" in expression:
            raise BrowserDriverError("scroll did not return to top")
        return SUCCESS


def test_audit_page_clears_hover_before_follow_up_audit(
    monkeypatch: MonkeyPatch,
) -> None:
    from audit_cli.crawl import page as page_module

    driver = _FakeDriver()
    queue = CrawlQueue(origin="http://127.0.0.1:3200")
    viewport = ViewportSpec(
        label="Mobile 390x844",
        kind="mobile",
        width=390,
        height=844,
    )
    inject_calls = 0

    def fake_inject_and_run(
        *args: object, **kwargs: object
    ) -> dict[str, dict[str, dict[str, list[object]]]]:
        nonlocal inject_calls
        inject_calls += 1
        return {"categories": {"text": {"issues": []}}}

    monkeypatch.setattr(page_module, "inject_and_run", fake_inject_and_run)
    monkeypatch.setattr(page_module, "_collect_anchor_hrefs", lambda _driver: [])
    monkeypatch.setattr(
        page_module,
        "discover_interactions",
        lambda snapshot, opts: InteractionPlan(
            candidates=(
                InteractionCandidate(
                    uid=4,
                    role="button",
                    name="Open navigation menu",
                    fingerprint="menu-button",
                ),
            ),
            cross_origin_candidates=(),
            dropped_social=(),
        ),
    )
    monkeypatch.setattr(page_module, "_count_visible_modals", lambda _driver: 0)
    monkeypatch.setattr(page_module, "_dismiss", lambda _driver: None)
    monkeypatch.setattr(page_module, "discover_hover_targets", lambda snapshot: ())
    monkeypatch.setattr(page_module, "_run_hover_pass", lambda _driver, _targets: [])

    audit_page(
        driver,
        server=SERVER,
        queue=queue,
        url="http://127.0.0.1:3200/",
        viewports=(viewport,),
        all_pages=False,
        same_origin_host="127.0.0.1:3200",
    )

    click_index = driver.calls.index(("click", 4))
    hover_index = driver.calls.index(("hover", "body"))
    assert inject_calls == 2
    assert hover_index > click_index


def test_audit_page_reports_missing_modal_backdrop_blur(
    monkeypatch: MonkeyPatch,
) -> None:
    from audit_cli.crawl import page as page_module

    driver = _ModalDriver()
    queue = CrawlQueue(origin="http://127.0.0.1:3200")
    viewport = ViewportSpec(
        label="Mobile 390x844",
        kind="mobile",
        width=390,
        height=844,
    )
    modal_counts = iter((0, 1))

    monkeypatch.setattr(
        page_module,
        "inject_and_run",
        lambda *args, **kwargs: {"categories": {"interaction": {"issues": []}}},
    )
    monkeypatch.setattr(page_module, "_collect_anchor_hrefs", lambda _driver: [])
    monkeypatch.setattr(
        page_module,
        "discover_interactions",
        lambda snapshot, opts: InteractionPlan(
            candidates=(
                InteractionCandidate(
                    uid=4,
                    role="button",
                    name="Open navigation menu",
                    fingerprint="menu-button",
                ),
            ),
            cross_origin_candidates=(),
            dropped_social=(),
        ),
    )
    monkeypatch.setattr(
        page_module, "_count_visible_modals", lambda _driver: next(modal_counts)
    )
    monkeypatch.setattr(page_module, "_run_modal_audit", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        page_module, "_probe_escape_dismissal", lambda *args, **kwargs: []
    )
    monkeypatch.setattr(page_module, "_dismiss", lambda _driver: None)
    monkeypatch.setattr(page_module, "discover_hover_targets", lambda snapshot: ())
    monkeypatch.setattr(page_module, "_run_hover_pass", lambda _driver, _targets: [])

    result = audit_page(
        driver,
        server=SERVER,
        queue=queue,
        url="http://127.0.0.1:3200/",
        viewports=(viewport,),
        all_pages=False,
        same_origin_host="127.0.0.1:3200",
    )

    assert any(
        issue.get("ruleId") == "DES-MODA-04" for issue in result.modal_findings
    )


def test_probe_modal_backdrop_accepts_visible_blurred_overlay() -> None:
    driver = _TruthyEvalDriver()

    issues = _probe_modal_backdrop(driver, selector_hint="modal@e4")

    assert issues == []


def test_probe_home_logo_behavior_reports_missing_scroll_to_top() -> None:
    driver = _LogoProbeDriver(fail_wait=True)

    issues = _probe_home_logo_behavior(
        driver,
        current_url="http://127.0.0.1:3200/",
        selector_hint="header-home-link",
    )

    assert any(issue.get("ruleId") == "DES-NAVI-04" for issue in issues)
